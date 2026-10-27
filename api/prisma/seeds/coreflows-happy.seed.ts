/** Booking demo entrypoint. The old map-generating V1 implementation has been retired. */
export * from './booking-demo.seed'
import { main, reportFailure } from './booking-demo.seed'
if (require.main === module) main().catch(reportFailure)
