'use strict';

const xStatusUrl = /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/;

function validateLearning(config, learning) {
  const errors = [];
  const fail = message => errors.push(message);
  if (config?.schemaVersion !== 1 || learning?.schemaVersion !== 1) fail('learning schemaVersion must be 1');
  if ((config?.tabs || []).map(tab => tab.id).join() !== 'curiosities,basics,nature,science') fail('learning tabs must be curiosities,basics,nature,science');
  if (config?.storyAudienceMinimumAge !== 18) fail('learning story audience must be 18+');
  if (!Array.isArray(learning?.dailyCuriosities) || !Array.isArray(learning?.lessons)) return {errors:[...errors,'learning content arrays missing'],curiosities:0,lessons:0};
  if (learning.dailyCuriosities.length > config.dailyCuriosityLimit) fail('learning daily curiosities exceed limit');
  const curiosityIds = new Set();
  for (const [index, item] of learning.dailyCuriosities.entries()) {
    if (!item.id || curiosityIds.has(item.id) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) fail(`learning curiosity ${index}: invalid id/date`);
    curiosityIds.add(item.id);
    if (!item.category || !item.title || !item.summary || !item.whyInteresting) fail(`learning curiosity ${index}: incomplete`);
    if (!xStatusUrl.test(item.source?.url || '') || !item.source?.author || Number.isNaN(Date.parse(item.source?.publishedAt))) fail(`learning curiosity ${index}: invalid X source`);
  }
  const lessonIds = new Set();
  for (const [index, item] of learning.lessons.entries()) {
    if (!item.id || lessonIds.has(item.id) || !item.title || !item.category || Number.isNaN(Date.parse(item.updatedAt))) fail(`learning lesson ${index}: invalid identity`);
    lessonIds.add(item.id);
    const professional = item.professional || {}, story = item.story || {};
    if (!professional.definition || !professional.mechanism || !professional.whyItMatters || !Array.isArray(professional.signals) || !professional.signals.length) fail(`learning lesson ${item.id}: incomplete professional version`);
    if (!story.title || !story.body || !Array.isArray(story.mapping) || !story.mapping.length || story.mapping.some(row => !row.storyRole || !row.professionalMeaning) || !story.boundary) fail(`learning lesson ${item.id}: incomplete story version`);
    if (!Array.isArray(item.commonMistakes) || !Array.isArray(item.relatedCuriosityIds) || item.relatedCuriosityIds.some(id => !curiosityIds.has(id))) fail(`learning lesson ${item.id}: invalid relations`);
    if (!Array.isArray(item.sources) || !item.sources.length || item.sources.some(source => !source.label || !xStatusUrl.test(source.url || ''))) fail(`learning lesson ${item.id}: invalid sources`);
  }
  return {errors,curiosities:curiosityIds.size,lessons:lessonIds.size};
}

module.exports={validateLearning};
