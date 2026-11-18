#!/usr/bin/env ruby
# Adapted from LOC's parsed-YAML workflow guard for LAS deployment ownership.
# Only the existing lunarcus Cloudflare Workers Build publishes server code.
# The Chrome client is packaged solely by explicit owner dispatch.
require 'psych'

EXPECTED_EVENTS = {
  'check-lunarcus.yml' => %w[pull_request workflow_dispatch],
  'deploy-las-mcp.yml' => %w[pull_request workflow_dispatch],
  'deploy-lunarcus-auth.yml' => %w[push workflow_dispatch],
  'notify-loc-after-auth.yml' => %w[check_run workflow_dispatch],
  'package-extension.yml' => %w[workflow_dispatch]
}.freeze

def mapping_field(node, key)
  return nil unless node.is_a?(Psych::Nodes::Mapping)
  node.children.each_slice(2).find do |name, _value|
    name.is_a?(Psych::Nodes::Scalar) && name.value == key
  end&.last
end

def scalar_list(node)
  case node
  when Psych::Nodes::Sequence
    node.children.map do |item|
      raise 'expected scalar YAML sequence' unless item.is_a?(Psych::Nodes::Scalar)
      item.value
    end
  when Psych::Nodes::Scalar
    [node.value]
  else
    raise 'expected scalar or scalar sequence'
  end
end

files = Dir.glob('.github/workflows/*.{yml,yaml}').sort
missing = EXPECTED_EVENTS.keys - files.map { |f| File.basename(f) }
errors = missing.map { |name| "Missing LAS workflow: #{name}" }

files.each do |file|
  begin
    name = File.basename(file)
    expected = EXPECTED_EVENTS[name]
    raise 'Unknown workflow needs an explicit LAS trigger policy' unless expected
    root = Psych.parse_file(file)&.root
    raise 'workflow root must be a mapping' unless root.is_a?(Psych::Nodes::Mapping)
    on = mapping_field(root, 'on')
    raise 'workflow must have a top-level on event' unless on
    events = case on
    when Psych::Nodes::Mapping
      on.children.each_slice(2).map do |key, _value|
        raise 'invalid workflow event' unless key.is_a?(Psych::Nodes::Scalar)
        key.value
      end
    else
      scalar_list(on)
    end
    raise "unexpected events: #{events.join(', ')}" unless events.sort == expected.sort

    if name == 'deploy-lunarcus-auth.yml'
      # GitHub only validates this build; Cloudflare Workers Builds deploys it.
      push = mapping_field(on, 'push')
      raise 'LAS server push requires explicit main branch mapping' unless push
      branches = scalar_list(mapping_field(push, 'branches'))
      raise 'LAS server verification must only follow main' unless branches == ['main']
      paths = scalar_list(mapping_field(push, 'paths'))
      raise 'LAS server paths must include its runtime' unless paths.include?('app/las/**/*.mjs')
      raise 'Chrome client must not trigger server verification' if paths.any? do |path|
        path.start_with?('plugins/', 'public/plugins/')
      end
      raise 'GitHub must never publish a second Worker' unless File.read(file).include?('deploy --dry-run')
    elsif name == 'notify-loc-after-auth.yml'
      check = mapping_field(on, 'check_run')
      raise 'LOC notification requires completed server build' unless scalar_list(mapping_field(check, 'types')) == ['completed']
    elsif name == 'package-extension.yml'
      raise 'Client ZIP must be a downloadable artifact, not a server deployment' unless
        File.read(file).include?('actions/upload-artifact@v4')
    end
  rescue StandardError, Psych::Exception => error
    errors << "#{file}: #{error.message}"
  end
end

if errors.any?
  errors.each { |message| warn "::error::#{message}" }
  exit 1
end
puts "LAS workflow guard: #{files.length} workflows valid; Worker auto/server only, Chrome manual, LOC independent."
