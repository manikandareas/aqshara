import { Module } from '@nestjs/common';
import { MistralOcrService } from './mistral-ocr.service';

@Module({
  providers: [MistralOcrService],
  exports: [MistralOcrService],
})
export class OcrModule {}
