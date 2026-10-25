import { PrismaClient } from '@prisma/client';
import { GEAR_RULE_METADATA_REGISTRY } from '../../src/modules/gear/domain/rule-metadata.registry';

export async function seedGearRules(prisma: PrismaClient) {
  console.log(`Seeding ${GEAR_RULE_METADATA_REGISTRY.length} Gear Requirement Rules...`);
  let createdCount = 0;
  let updatedCount = 0;

  for (const rule of GEAR_RULE_METADATA_REGISTRY) {
    const existing = await prisma.gearRequirementRule.findUnique({
      where: { id: rule.id },
    });

    if (!existing) {
      await prisma.gearRequirementRule.create({
        data: {
          id: rule.id,
          category: rule.category as any,
          defaultVerdict: rule.defaultVerdict as any,
          templateVi: rule.templateVi,
          isActive: rule.isActive,
          ruleVersion: rule.ruleVersion,
        },
      });
      createdCount++;
    } else {
      await prisma.gearRequirementRule.update({
        where: { id: rule.id },
        data: {
          category: rule.category as any,
          defaultVerdict: rule.defaultVerdict as any,
          templateVi: rule.templateVi,
          isActive: rule.isActive,
          ruleVersion: rule.ruleVersion,
        },
      });
      updatedCount++;
    }
  }

  console.log(
    `Gear Requirement Rules seeded: ${createdCount} created, ${updatedCount} updated (total: ${GEAR_RULE_METADATA_REGISTRY.length}).`,
  );
  return { createdCount, updatedCount, total: GEAR_RULE_METADATA_REGISTRY.length };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedGearRules(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

