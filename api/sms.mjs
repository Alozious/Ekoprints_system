import { createMarketingApi } from '../server/marketing.mjs';
import { createVercelMarketingHandler } from '../server/vercelMarketing.mjs';
export default createVercelMarketingHandler(createMarketingApi());
