import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('../plugins/chrome/capture-source-model.js',import.meta.url),'utf8');
const context={URL};
runInNewContext(source,context);
const model=context.LasCaptureSourceModel;
const card=(urls)=>({querySelectorAll:()=>urls.map(href=>({
  getAttribute:key=>key==='href'?href:null
}))});
test('Social source identity requires exact host and durable post permalink',()=>{
  assert.equal(model.permalink('https://evil.instagram.com/p/ABCD123/'),null);
  assert.equal(model.permalink('https://instagram.com.example.test/p/ABCD123/'),null);
  assert.equal(model.permalink('http://www.instagram.com/p/ABCD123/'),null);
  assert.equal(model.permalink('https://www.instagram.com/explore/'),null);
  assert.equal(model.permalink('https://www.threads.com/@sample/'),null);
  assert.equal(model.permalink('https://www.facebook.com/groups/1/'),null);
  assert.equal(model.permalink('https://www.instagram.com/p/ABCD123/?utm_source=ad').url,
    'https://www.instagram.com/p/ABCD123/');
  assert.equal(model.permalink('https://threads.net/@alice/post/ABCDE123').url,
    'https://www.threads.com/@alice/post/ABCDE123/');
  assert.equal(model.permalink('https://m.facebook.com/groups/sample/posts/12345678/').url,
    'https://www.facebook.com/groups/sample/posts/12345678/');
  assert.equal(model.permalink('https://www.facebook.com/permalink.php?id=12345&story_fbid=6789012&fbclid=track').url,
    'https://www.facebook.com/permalink.php?story_fbid=6789012&id=12345');
});
test('Ambiguous repost and nested-card identities never silently queue the first link',()=>{
  const page='https://www.instagram.com/';
  assert.equal(model.sourceForCard(card([
    '/p/ABCDEFG/','/p/HIJKLMN/']),page),null);
  assert.equal(model.sourceForCard(card(['/p/ABCDEFG/','/p/ABCDEFG/?utm_source=x']),page).url,
    'https://www.instagram.com/p/ABCDEFG/');
  assert.equal(model.sourceForCard(card(['/explore/']),page),null);
  assert.equal(model.sourceForCard(card(['https://facebook.com/user/posts/1234567']),page),null);
  assert.equal(model.sourceForCard(card([]),'https://www.instagram.com/p/ABCDEFG/'),null,
    'A nested comment without permalink must not inherit the page identity');
});
test('Browser injects the capture model before content extraction',()=>{
  const background=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
  const content=readFileSync(new URL('../plugins/chrome/content.js',import.meta.url),'utf8');
  assert.match(background,/capture-source-model\\.js','content\\.js'/);
  assert.match(content,/sourceModel\.sourceForCard/);
  assert.match(content,/emittedSources/);
});
