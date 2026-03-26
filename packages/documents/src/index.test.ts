import test from 'node:test';
import assert from 'node:assert';

import {
  createEmptyDocument,
  createTemplateDocument,
  outlineDraftToDocumentValue,
  applyDocumentChangeProposal,
  toPlainText,
} from './index.ts';

import type {
  OutlineDraft,
  DocumentValue,
  DocumentChangeProposal
} from './index.ts';

function createIdGenerator() {
  let id = 0;
  return () => `id-${id++}`;
}

test('createEmptyDocument returns a valid empty document', () => {
  const doc = createEmptyDocument(createIdGenerator());
  assert.strictEqual(doc.length, 1);
  assert.strictEqual(doc[0]?.type, 'paragraph');
  assert.strictEqual(doc[0]?.id, 'id-0');
});

test('createTemplateDocument produces general_paper template', () => {
  const doc = createTemplateDocument('general_paper', createIdGenerator());
  assert.ok(doc.length > 0);
  assert.strictEqual(doc[0]?.type, 'heading');
  assert.strictEqual(doc[0]?.id, 'id-0');
});

test('outlineDraftToDocumentValue converts draft to blocks deterministically', () => {
  const draft: OutlineDraft = {
    title: 'Test Title',
    nodes: [
      { type: 'paragraph', text: 'Hello world' },
      { type: 'bullet_list', items: ['Item 1', 'Item 2'] }
    ]
  };
  const doc = outlineDraftToDocumentValue(draft, createIdGenerator());
  assert.strictEqual(doc.length, 3);
  
  assert.strictEqual(doc[0]?.type, 'heading');
  assert.strictEqual(doc[0]?.id, 'id-0');
  
  assert.strictEqual(doc[1]?.type, 'paragraph');
  assert.strictEqual(doc[1]?.id, 'id-1');
  
  assert.strictEqual(doc[2]?.type, 'bullet-list');
  assert.strictEqual(doc[2]?.id, 'id-2');
  
  const bulletList = doc[2];
  if (bulletList?.type !== 'bullet-list') {
    assert.fail('Expected bullet-list');
  }
  
  assert.strictEqual(bulletList.children.length, 2);
  assert.strictEqual(bulletList.children[0]?.type, 'list-item');
  assert.strictEqual(bulletList.children[0]?.id, 'id-3');
});

test('applyDocumentChangeProposal replace multiple blocks with validation', () => {
  const doc: DocumentValue = [
    { type: 'paragraph', id: 'p1', children: [{ text: 'P1' }] },
    { type: 'paragraph', id: 'p2', children: [{ text: 'P2' }] },
    { type: 'paragraph', id: 'p3', children: [{ text: 'P3' }] }
  ];
  
  const proposal: DocumentChangeProposal = {
    id: 'prop1',
    targetBlockIds: ['p1', 'p2'],
    action: 'replace',
    nodes: [
      { type: 'heading', id: 'h1', level: 1, children: [{ text: 'Replaced 1 and 2' }] }
    ]
  };

  const newDoc = applyDocumentChangeProposal(doc, proposal);
  assert.strictEqual(newDoc.length, 2);
  assert.strictEqual(newDoc[0]?.type, 'heading');
  assert.strictEqual(newDoc[0]?.id, 'h1');
  assert.strictEqual(newDoc[1]?.id, 'p3');
});

test('applyDocumentChangeProposal throws on non-contiguous replace targets', () => {
  const doc: DocumentValue = [
    { type: 'paragraph', id: 'p1', children: [{ text: 'P1' }] },
    { type: 'paragraph', id: 'p2', children: [{ text: 'P2' }] },
    { type: 'paragraph', id: 'p3', children: [{ text: 'P3' }] }
  ];
  
  const proposal: DocumentChangeProposal = {
    id: 'prop1',
    targetBlockIds: ['p1', 'p3'],
    action: 'replace',
    nodes: [
      { type: 'heading', id: 'h1', level: 1, children: [{ text: 'Replace 1 and 3' }] }
    ]
  };

  assert.throws(() => {
    applyDocumentChangeProposal(doc, proposal);
  }, /Target blocks for 'replace' must be contiguous/);
});

test('applyDocumentChangeProposal insert_below', () => {
  const doc: DocumentValue = [
    { type: 'paragraph', id: 'p1', children: [{ text: 'P1' }] },
    { type: 'paragraph', id: 'p2', children: [{ text: 'P2' }] }
  ];
  
  const proposal: DocumentChangeProposal = {
    id: 'prop1',
    targetBlockIds: ['p1'],
    action: 'insert_below',
    nodes: [
      { type: 'paragraph', id: 'p_new', children: [{ text: 'New' }] }
    ]
  };

  const newDoc = applyDocumentChangeProposal(doc, proposal);
  assert.strictEqual(newDoc.length, 3);
  assert.strictEqual(newDoc[0]?.id, 'p1');
  assert.strictEqual(newDoc[1]?.id, 'p_new');
  assert.strictEqual(newDoc[2]?.id, 'p2');
});

test('applyDocumentChangeProposal insert_below throws on multiple targets', () => {
  const doc: DocumentValue = [
    { type: 'paragraph', id: 'p1', children: [{ text: 'P1' }] },
    { type: 'paragraph', id: 'p2', children: [{ text: 'P2' }] }
  ];
  
  const proposal: DocumentChangeProposal = {
    id: 'prop1',
    targetBlockIds: ['p1', 'p2'],
    action: 'insert_below',
    nodes: [
      { type: 'paragraph', id: 'p_new', children: [{ text: 'New' }] }
    ]
  };

  assert.throws(() => {
    applyDocumentChangeProposal(doc, proposal);
  }, /Action 'insert_below' requires exactly one target block id/);
});

test('applyDocumentChangeProposal throws on invalid target', () => {
  const doc: DocumentValue = [
    { type: 'paragraph', id: 'p1', children: [{ text: 'P1' }] }
  ];
  
  const proposal: DocumentChangeProposal = {
    id: 'prop1',
    targetBlockIds: ['invalid-id'],
    action: 'replace',
    nodes: []
  };

  assert.throws(() => {
    applyDocumentChangeProposal(doc, proposal);
  }, /Target block with id 'invalid-id' not found/);
});

test('toPlainText deterministic behavior', () => {
  const doc: DocumentValue = [
    { type: 'heading', id: 'h1', level: 1, children: [{ text: 'Title' }] },
    { type: 'paragraph', id: 'p1', children: [{ text: 'Para' }] },
    { 
      type: 'bullet-list', 
      id: 'l1', 
      children: [
        { type: 'list-item', id: 'li1', children: [{ text: 'Item 1' }] },
        { type: 'list-item', id: 'li2', children: [{ text: 'Item 2' }] }
      ]
    }
  ];

  const text = toPlainText(doc);
  assert.strictEqual(text, 'Title\nPara\nItem 1\nItem 2');
});
