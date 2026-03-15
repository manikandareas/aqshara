import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class DocumentProcessJobDto {
  @IsString({ message: '"document_id" must be a non-empty string' })
  @IsNotEmpty({ message: '"document_id" must be a non-empty string' })
  document_id!: string;

  @IsString({ message: '"actor_id" must be a non-empty string' })
  @IsNotEmpty({ message: '"actor_id" must be a non-empty string' })
  actor_id!: string;

  @IsBoolean({ message: '"require_translate" must be a boolean' })
  require_translate!: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: '"request_id" must be a string, null, or omitted' })
  request_id?: string | null;
}

export class TranslationRetryJobDto {
  @IsString({ message: '"document_id" must be a non-empty string' })
  @IsNotEmpty({ message: '"document_id" must be a non-empty string' })
  document_id!: string;

  @IsString({ message: '"paragraph_id" must be a non-empty string' })
  @IsNotEmpty({ message: '"paragraph_id" must be a non-empty string' })
  paragraph_id!: string;

  @IsString({ message: '"actor_id" must be a non-empty string' })
  @IsNotEmpty({ message: '"actor_id" must be a non-empty string' })
  actor_id!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: '"request_id" must be a string, null, or omitted' })
  request_id?: string | null;
}
