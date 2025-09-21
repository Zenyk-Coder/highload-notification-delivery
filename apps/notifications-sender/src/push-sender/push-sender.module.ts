import { Module } from '@nestjs/common';
import { PushSenderService } from './push-sender.service';

@Module({
  imports: [],
  controllers: [],
  providers: [PushSenderService],
  exports: [PushSenderService],
})
export class PushSenderModule {}
