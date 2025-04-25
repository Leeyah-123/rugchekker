import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { VybeService } from './vybe.service';

@Module({
  imports: [HttpModule],
  providers: [VybeService],
  exports: [VybeService],
})
export class VybeModule {}
