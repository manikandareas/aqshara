import { ApiProperty } from '@nestjs/swagger';

export class FeedbackCreateDataDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  created_at!: string;
}

export class FeedbackCreateEnvelopeDto {
  @ApiProperty({ type: FeedbackCreateDataDto })
  data!: FeedbackCreateDataDto;
}

export class AcceptedEventsPayloadDto {
  @ApiProperty()
  accepted!: number;
}

export class AcceptedEventsEnvelopeDto {
  @ApiProperty({ type: AcceptedEventsPayloadDto })
  data!: AcceptedEventsPayloadDto;
}
