export type TemplateCode = 'blank' | 'general_paper' | 'proposal' | 'skripsi';

export type TText = { text: string };
export type TElement = { type: string; id: string; children: (TElement | TText)[] };

export type HeadingElement = {
  type: "heading";
  id: string;
  level: 1 | 2 | 3;
  children: TText[];
};

export type ParagraphElement = {
  type: "paragraph";
  id: string;
  children: TText[];
};

export type ListItemElement = {
  type: "list-item";
  id: string;
  children: TText[];
};

export type BulletListElement = {
  type: "bullet-list";
  id: string;
  children: ListItemElement[];
};

export type DocumentBlock = HeadingElement | ParagraphElement | BulletListElement;
export type DocumentValue = DocumentBlock[];




export type OutlineDraftNode =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] };

export type OutlineDraft = {
  title: string;
  nodes: OutlineDraftNode[];
};

export type DocumentChangeProposal = {
  id: string;
  targetBlockIds: string[];
  action: "replace" | "insert_below";
  nodes: DocumentBlock[];
};

export function createEmptyDocument(generateId: () => string = () => crypto.randomUUID()): DocumentValue {
  return [
    {
      type: "paragraph",
      id: generateId(),
      children: [{ text: "" }],
    },
  ];
}

export function outlineDraftToDocumentValue(
  draft: OutlineDraft, 
  generateId: () => string = () => crypto.randomUUID()
): DocumentValue {
  const nodes: DocumentValue = [];
  
  if (draft.title) {
    nodes.push({
      type: "heading",
      id: generateId(),
      level: 1,
      children: [{ text: draft.title }],
    });
  }

  for (const node of draft.nodes) {
    if (node.type === "heading") {
      nodes.push({
        type: "heading",
        id: generateId(),
        level: node.level,
        children: [{ text: node.text }],
      });
    } else if (node.type === "paragraph") {
      nodes.push({
        type: "paragraph",
        id: generateId(),
        children: [{ text: node.text }],
      });
    } else if (node.type === "bullet_list") {
      nodes.push({
        type: "bullet-list",
        id: generateId(),
        children: node.items.map((item) => ({
          type: "list-item",
          id: generateId(),
          children: [{ text: item }],
        })),
      });
    }
  }

  return nodes.length > 0 ? nodes : createEmptyDocument(generateId);
}

export function createTemplateDocument(
  code: TemplateCode, 
  generateId: () => string = () => crypto.randomUUID()
): DocumentValue {
  switch (code) {
    case 'general_paper':
      return outlineDraftToDocumentValue({
        title: "General Paper",
        nodes: [
          { type: "heading", level: 1, text: "Introduction" },
          { type: "paragraph", text: "Start your paper here." },
        ],
      }, generateId);
    case 'proposal':
      return outlineDraftToDocumentValue({
        title: "Proposal",
        nodes: [
          { type: "heading", level: 1, text: "Background" },
          { type: "paragraph", text: "Provide background information." },
        ],
      }, generateId);
    case 'skripsi':
      return outlineDraftToDocumentValue({
        title: "Skripsi",
        nodes: [
          { type: "heading", level: 1, text: "Bab 1: Pendahuluan" },
          { type: "paragraph", text: "Latar belakang masalah." },
        ],
      }, generateId);
    case 'blank':
    default:
      return createEmptyDocument(generateId);
  }
}

export function applyDocumentChangeProposal(
  document: DocumentValue,
  proposal: DocumentChangeProposal
): DocumentValue {
  if (proposal.action === "insert_below") {
    if (proposal.targetBlockIds.length !== 1) {
      throw new Error(`Action 'insert_below' requires exactly one target block id.`);
    }
    const targetId = proposal.targetBlockIds[0];
    const index = document.findIndex((block) => block.id === targetId);
    if (index === -1) {
      throw new Error(`Target block with id '${targetId}' not found.`);
    }
    const newDoc = [...document];
    newDoc.splice(index + 1, 0, ...proposal.nodes);
    return newDoc;
  } else if (proposal.action === "replace") {
    if (proposal.targetBlockIds.length === 0) {
      throw new Error(`Action 'replace' requires at least one target block id.`);
    }
    const indices = proposal.targetBlockIds.map((id) => {
      const idx = document.findIndex((block) => block.id === id);
      if (idx === -1) {
        throw new Error(`Target block with id '${id}' not found.`);
      }
      return idx;
    });

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1]! + 1) {
        throw new Error(`Target blocks for 'replace' must be contiguous.`);
      }
    }

    const startIndex = indices[0]!;
    const count = indices.length;

    const newDoc = [...document];
    newDoc.splice(startIndex, count, ...proposal.nodes);
    return newDoc;
  } else {
    throw new Error(`Invalid proposal action.`);
  }
}

export function toPlainText(document: DocumentValue): string {
  function nodeToText(node: TElement | TText): string {
    if ('text' in node) {
      return node.text;
    }
    
    const childrenText = node.children.map(nodeToText).join('');
    
    if (node.type === "paragraph" || node.type === "heading") {
      return childrenText + '\n';
    }
    if (node.type === "list-item") {
      return childrenText + '\n';
    }
    if (node.type === "bullet-list") {
      return childrenText;
    }
    
    return childrenText;
  }

  return document.map(nodeToText).join('').trim();
}

