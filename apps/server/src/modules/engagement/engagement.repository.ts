import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../infrastructure/database/database.service';

export type CreateFeedbackInput = {
  actorId: string;
  documentId: string;
  type: string;
  rating: number | null;
  comment: string | null;
  issueType: string | null;
  description: string | null;
  paragraphId: string | null;
};

export type EventInsertInput = {
  actorId: string;
  documentId: string | null;
  type: string;
  timestamp: Date;
  payload: Record<string, unknown>;
};

@Injectable()
export class EngagementRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createFeedback(input: CreateFeedbackInput): Promise<{
    id: string;
    type: string;
    created_at: Date;
  }> {
    const id = randomUUID();

    const result = await this.databaseService.query<{
      id: string;
      type: string;
      created_at: Date;
    }>(
      `
      INSERT INTO feedback (
        id,
        actor_id,
        document_id,
        type,
        rating,
        comment,
        issue_type,
        description,
        paragraph_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, type, created_at
      `,
      [
        id,
        input.actorId,
        input.documentId,
        input.type,
        input.rating,
        input.comment,
        input.issueType,
        input.description,
        input.paragraphId,
      ],
    );

    return result.rows[0] as {
      id: string;
      type: string;
      created_at: Date;
    };
  }

  async insertEventsBatch(events: EventInsertInput[]): Promise<number> {
    if (events.length === 0) {
      return 0;
    }

    return this.databaseService.withTransaction(async (client) => {
      const values: unknown[] = [];
      const placeholders = events.map((event, index) => {
        const base = index * 6;
        values.push(
          randomUUID(),
          event.actorId,
          event.documentId,
          event.type,
          event.timestamp,
          JSON.stringify(event.payload),
        );

        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb)`;
      });

      const result = await client.query(
        `
        INSERT INTO events (
          id,
          actor_id,
          document_id,
          type,
          timestamp,
          payload
        ) VALUES ${placeholders.join(', ')}
        `,
        values,
      );

      return result.rowCount ?? 0;
    });
  }
}
