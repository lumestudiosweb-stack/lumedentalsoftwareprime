const cron = require('node-cron');
const CrmEvent = require('../models/CrmEvent');
const logger = require('../utils/logger');

function initializeCronJobs() {
  // Process due CRM events every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const dueEvents = await CrmEvent.findScheduledDue();
      for (const event of dueEvents) {
        await processCrmEvent(event);
      }
      if (dueEvents.length > 0) {
        logger.info(`Processed ${dueEvents.length} CRM events`);
      }
    } catch (err) {
      logger.error('CRM cron job error:', err);
    }
  });

  logger.info('Cron jobs initialized');
}

async function processCrmEvent(event) {
  try {
    // In production, integrate with Twilio/SendGrid here
    // For now, mark as sent
    await CrmEvent.update(event.id, {
      status: 'sent',
      sent_at: new Date(),
      message_sent: event.message_template, // Would be populated with actual patient data
    });

    logger.info(`CRM event ${event.id} (${event.event_type}) sent to patient ${event.patient_id}`);
  } catch (err) {
    await CrmEvent.update(event.id, {
      status: 'failed',
      retry_count: (event.retry_count || 0) + 1,
    });
    logger.error(`Failed to process CRM event ${event.id}:`, err);
  }
}

module.exports = { initializeCronJobs };
