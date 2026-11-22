// One Zod 4 source of truth for MCP JSON Schema advertising and requests.
// No separate hand-maintained JSON schemas, parallel validators, or SQL access.
import {z} from 'zod';

const SCOPE_ID=z.string().regex(/^[a-z][a-z0-9]{0,14}$/);
const UID=z.string().regex(/^[A-Za-z0-9]{8}$/);
// LOC SaaS validates its live public-Scope registry; LAS never copies it.
const publicScope=SCOPE_ID;
const nonNegative=z.int().min(0);
const action=z.enum(['search','read','check','record','record_ordered']);
const conversationRecord=z.strictObject({
  role:z.enum(['user','assistant']),kind:z.enum(['original','advice']).optional(),
  sent_at:z.string().optional(),text:z.string(),message_id:z.string(),
  source_order:z.int().min(0).optional(),parent_id:z.string().nullable().optional()
});
const none=z.strictObject({});
export const MCP_TOOL_INPUTS=Object.freeze({
  loc_connection_status:none,
  read_memory:z.strictObject({
    uid:UID.describe('Exact Galaxy article UID'),
    scopeid:publicScope.optional(),
    offset:nonNegative.max(1000000).optional(),
    max_chars:z.int().min(1).max(40000).optional()
  }),
  galaxy_link:z.strictObject({
    action,scopeid:SCOPE_ID,uid:UID.optional(),
    site:z.enum(['mcp','LOC']).optional(),
    query:z.string().min(2).max(100).optional(),
    limit:z.int().min(1).max(5).optional(),
    user_requested:z.boolean().optional(),
    conversation_id:z.string().optional(),
    updated_at:z.string().optional(),created_at:z.string().optional(),
    records:z.array(conversationRecord).min(1).max(100).optional(),
    title:z.string().max(350).optional(),
    content:z.string().max(125000).optional(),
    offset:nonNegative.optional(),
    max_chars:z.int().min(1).max(40000).optional()
  }),
  article_distribution:z.strictObject({
    period:z.enum(['calendar_year','rolling_12_months']).optional(),
    year:z.int().min(2020).max(2100).optional()
  })
});

// Let the installed Zod module generate the MCP-facing JSON Schema.
// The same schema will parse tool arguments before any external call or SQL.
export function mcpToolJsonSchema(name){
  return z.toJSONSchema(MCP_TOOL_INPUTS[name]);
}
export function parseMcpToolArgs(name,input){
  const parsed=MCP_TOOL_INPUTS[name]?.safeParse(input);
  return parsed?.success?parsed.data:null;
}
export const McpRpcSchema=z.looseObject({
  jsonrpc:z.literal('2.0'),
  id:z.union([z.string(),z.number(),z.null()]).optional(),
  method:z.string().min(1),
  params:z.unknown().optional()
});
