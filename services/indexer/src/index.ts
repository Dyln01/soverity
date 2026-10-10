import { ponder } from "@/generated";

/**
 * Handlers — keep the derived tables minimal and privacy-preserving:
 * only public on-chain data is indexed (usernames, permission grants,
 * attestation UIDs). Credential CONTENTS never appear on-chain, so they
 * can never appear here either.
 */

ponder.on("SoverityRegistry:PassCreated", async ({ event, context }) => {
  const { Account } = context.entities;
  await Account.upsert({
    id: event.args.did,
    data: {
      username: event.args.username,
      account: event.args.account,
      createdAt: Number(event.block.timestamp),
    },
  });
});

ponder.on("SoverityRegistry:ProfileUpdated", async ({ event, context }) => {
  const { Account } = context.entities;
  await Account.update({
    id: event.args.did,
    data: { username: event.args.username },
  });
});

ponder.on("SoverityPermissions:PermissionGranted", async ({ event, context }) => {
  const { Permission } = context.entities;
  await Permission.upsert({
    id: `${event.args.user}-${event.args.dapp}`,
    data: {
      user: event.args.user,
      dapp: event.args.dapp,
      scopes: String(event.args.scopes),
      grantedAt: Number(event.block.timestamp),
      revokedAt: null,
    },
  });
});

ponder.on("SoverityPermissions:PermissionRevoked", async ({ event, context }) => {
  const { Permission } = context.entities;
  await Permission.update({
    id: `${event.args.user}-${event.args.dapp}`,
    data: { revokedAt: Number(event.block.timestamp) },
  });
});
