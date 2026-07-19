// functions/submitScore/index.mjs
//
// Kiroman leaderboard write Lambda (Node.js 22, ESM). Backs `POST /scores` on
// the HTTP API. Validates the submission server-side (the server trusts nothing
// from the client) and performs a best-per-alias conditional upsert into the
// single-partition DynamoDB table.
//
// Lean deploy: imports ONLY @aws-sdk/* (provided by the Lambda runtime), so no
// node_modules bundling is required. The pure parsing/validation logic lives in
// ./validate.mjs and is unit-tested without AWS.
//
// Best-per-alias (Requirements 5.4, 5.5): each alias is one item keyed by
// (pk="LEADERBOARD", alias). A conditional UpdateCommand writes the new level +
// score + achievedAt ONLY IF the item does not exist OR the new result is
// strictly better than the stored one — a higher level, or the same level with
// a higher score (matching how the leaderboard ranks). When the condition
// fails, the existing entry was already >= this result, so we leave it
// unchanged and report updated:false (still a 200 success).
//
// achievedAt is stamped server-side (Date.now()) at write time and is only
// updated when the stored best actually improves, so it reflects when the
// player's best result was set — the final tiebreaker the leaderboard sorts on.
//
// Requirements:
//   5.3 - re-validate alias length and positive-integer level; 400 on bad input.
//   5.4 - keep only the higher level for an alias that already has an entry.
//   5.5 - leave the existing entry unchanged when the new result is not higher.
//   8.5 - respond with CORS headers permitting the deployed origin.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { parseSubmission } from './validate.mjs';

const TABLE_NAME = process.env.LEADERBOARD_TABLE ?? 'kiroman-leaderboard';
const PARTITION_KEY = 'LEADERBOARD';
// CORS origin: "*" for now; Task 7.4 ties this to the CloudFront origin via env.
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

/**
 * Standard CORS headers for the HTTP API v2 proxy responses (Requirement 8.5).
 */
function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Build an API Gateway (HTTP API v2) proxy response.
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

/**
 * Conditionally upsert the best result for an alias.
 *
 * Writes level + score + achievedAt only IF the item does not exist OR the new
 * result is strictly better than the stored one, where "better" matches the
 * leaderboard ranking: a higher level, or the same level with a higher score.
 * Returns whether a write happened.
 *
 * @param {string} alias - validated, trimmed alias.
 * @param {number} level - validated positive integer level.
 * @param {number} score - validated non-negative integer score for this run.
 * @returns {Promise<boolean>} true if the entry was written (new best), false
 *   if the existing entry was already >= this result (condition failed).
 */
async function upsertBest(alias, level, score) {
  const achievedAt = Date.now();
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: PARTITION_KEY, alias },
        UpdateExpression: 'SET #level = :level, #score = :score, achievedAt = :achievedAt',
        ConditionExpression:
          'attribute_not_exists(pk) OR :level > #level OR (:level = #level AND :score > #score)',
        ExpressionAttributeNames: { '#level': 'level', '#score': 'score' },
        ExpressionAttributeValues: {
          ':level': level,
          ':score': score,
          ':achievedAt': achievedAt,
        },
      }),
    );
    return true;
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      // Existing entry was already >= the new level — not an error (R5.5).
      return false;
    }
    throw err;
  }
}

/**
 * Lambda entry point. Never throws: validation failures return 400 and
 * unexpected errors return 500, both with CORS headers so the browser fetch
 * path stays well-behaved.
 *
 * @param {{ body?: string }} event - HTTP API v2 proxy event.
 */
export async function handler(event) {
  try {
    const parsed = parseSubmission(event?.body);
    if (!parsed.ok) {
      return response(400, { error: parsed.error });
    }

    const updated = await upsertBest(parsed.alias, parsed.level, parsed.score);
    return response(200, { ok: true, updated });
  } catch (err) {
    console.error('submitScore failed:', err);
    return response(500, { error: 'Failed to submit score' });
  }
}
