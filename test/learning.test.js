const test=require('node:test');
const assert=require('node:assert/strict');
const {validateLearning}=require('../scripts/lib/learning');

const config={
  schemaVersion:1,
  tabs:[{id:'basics'},{id:'nature'},{id:'science'},{id:'counterintuitive'}],
  storyAudienceMinimumAge:18
};
const curiosity={
  id:'2026-10-16-example',date:'2026-10-16',category:'半导体',title:'题目',summary:'事实',whyInteresting:'原因',
  source:{author:'example',url:'https://x.com/example/status/123',publishedAt:'2026-10-16T08:00:00Z'}
};
const lesson={
  id:'example',title:'知识点',category:'半导体',updatedAt:'2026-10-16T08:00:00Z',
  professional:{definition:'定义',mechanism:'机制',whyItMatters:'意义',signals:['指标']},
  story:{title:'故事',body:'正文',mapping:[{storyRole:'角色',professionalMeaning:'概念'}],boundary:'边界'},
  commonMistakes:[],relatedCuriosityIds:['2026-10-16-example'],sources:[{label:'原帖',url:'https://x.com/example/status/123'}]
};

test('learning accepts one knowledge point with professional and adult story versions',()=>{
  const result=validateLearning(config,{schemaVersion:1,dailyCuriosities:[curiosity],lessons:[lesson]});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.lessons,1);
});

test('learning rejects a lesson missing either explanation or analogy boundary',()=>{
  const noProfessional=structuredClone(lesson);delete noProfessional.professional.mechanism;
  assert.match(validateLearning(config,{schemaVersion:1,dailyCuriosities:[curiosity],lessons:[noProfessional]}).errors.join('\n'),/professional version/);
  const noBoundary=structuredClone(lesson);delete noBoundary.story.boundary;
  assert.match(validateLearning(config,{schemaVersion:1,dailyCuriosities:[curiosity],lessons:[noBoundary]}).errors.join('\n'),/story version/);
});
