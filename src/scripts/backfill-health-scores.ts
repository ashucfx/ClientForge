import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log('Starting Health Score Backfill...');

  const feedbacks = await db.feedback.findMany();
  console.log(`Found ${feedbacks.length} feedbacks to process.`);

  let updatedCount = 0;

  for (const fb of feedbacks) {
    // True weighting algorithm
    const ratingScore = ((fb.rating - 1) / 4) * 100;
    const commScore = ((fb.communication - 1) / 4) * 100;
    const slaScore = ((fb.turnaroundTime - 1) / 4) * 100;
    
    const revisionCount = fb.revisionCount || 0;
    const revScore = Math.max(0, 100 - (revisionCount * 25));

    const healthScore = (ratingScore * 0.4) + (commScore * 0.2) + (slaScore * 0.2) + (revScore * 0.2);
    const satisfaction = ratingScore;

    let healthStatus = 'EXCELLENT';
    if (healthScore < 50) healthStatus = 'AT_RISK';
    else if (healthScore < 75) healthStatus = 'ATTENTION_NEEDED';
    else if (healthScore < 90) healthStatus = 'HEALTHY';

    if (fb.careerClientId) {
      await db.clientHealthScore.update({
        where: { careerClientId: fb.careerClientId },
        data: {
          score: healthScore,
          satisfaction,
          status: healthStatus,
          lastCalculatedAt: new Date(),
        }
      });
      updatedCount++;
    } else if (fb.rnClientId) {
      await db.clientHealthScore.update({
        where: { rnClientId: fb.rnClientId },
        data: {
          score: healthScore,
          satisfaction,
          status: healthStatus,
          lastCalculatedAt: new Date(),
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully backfilled ${updatedCount} health scores.`);
}

main()
  .catch(e => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
