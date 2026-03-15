export type FeedbackRequest = {
  type: string;
  rating?: number;
  comment?: string;
  issue_type?: string;
  description?: string;
  paragraph_id?: string;
};

export type FeedbackCreateData = {
  id: string;
  type: string;
  created_at: string;
};

export type EventPayload = {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  document_id?: string;
};

export type EventsRequest = {
  events: EventPayload[];
};

export type AcceptedEventsPayload = {
  accepted: number;
};
