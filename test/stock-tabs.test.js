const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function button(name) {
  return {
    dataset:{stockTab:name},attributes:{},tabIndex:0,listeners:{},focused:false,
    setAttribute(key,value){this.attributes[key]=value;},
    addEventListener(name,handler){this.listeners[name]=handler;},
    focus(){this.focused=true;}
  };
}

test('stock tabs default to news and support click plus keyboard navigation',()=> {
  const news=button('news'); const people=button('people');
  const newsPanel={dataset:{stockPanel:'news'},hidden:false};
  const peoplePanel={dataset:{stockPanel:'people'},hidden:false};
  const events={};
  const location={hash:'',pathname:'/stocks.html',search:''};
  const history={replaceState(_a,_b,url){const hash=url.indexOf('#'); location.hash=hash>=0?url.slice(hash):'';}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../stock-tabs.js'),'utf8'),{
    document:{querySelectorAll(selector){return selector.includes('data-stock-tab')?[news,people]:[newsPanel,peoplePanel];}},
    location,history,addEventListener(name,handler){events[name]=handler;}
  });
  assert.equal(news.attributes['aria-selected'],'true');
  assert.equal(peoplePanel.hidden,true);
  people.listeners.click();
  assert.equal(people.attributes['aria-selected'],'true');
  assert.equal(newsPanel.hidden,true);
  assert.equal(location.hash,'#people');
  people.listeners.keydown({key:'ArrowLeft',preventDefault(){}});
  assert.equal(news.attributes['aria-selected'],'true');
  assert.equal(news.focused,true);
});

test('stocks page declares both accessible tab panels',()=> {
  const html=fs.readFileSync(path.join(__dirname,'../stocks.html'),'utf8');
  assert.match(html,/role="tab"[^>]+data-stock-tab="news">美股讯息/);
  assert.match(html,/role="tab"[^>]+data-stock-tab="people">具体人物/);
  assert.match(html,/role="tabpanel"[^>]+data-stock-panel="news"/);
  assert.match(html,/role="tabpanel"[^>]+data-stock-panel="people"/);
});
