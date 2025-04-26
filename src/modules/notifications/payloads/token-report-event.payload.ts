import { TokenReport } from 'src/schemas/token-report.schema';
import { WatchSubscription } from 'src/schemas/watch-subscription.schema';

export class TokenReportEvent {
  constructor(
    public readonly watchers: WatchSubscription[],
    public readonly report: TokenReport,
    public readonly type: 'token' | 'creator',
  ) {}
}
