// functions/getLeaderboard/index.mjs
//
// Kiroman leaderboard read Lambda (Node.js 22, ESM). Backs `GET /leaderboard`
// on the HTTP API. Queries the single-partition DynamoDB table for all entries
// and returns the top three (sorted by level desc, then achievedAt asc).
//
// Lean deploy: imports ONLY @aws-sdk/* (provided by the Lambda runtime), so no
// node_modules bundling is required. The pure sort/top-N/shaping logic lives in
// ./leaderboard.mjs and is unit-tested without AWS.
//
// Requirements:
//   5.1 - fetch and return the top three entries by highest level.
//   5.2 - each entry exposes alias and highest level reached.
//   5.6 - equal levels ordered earliest-achieved first.
//   8.5 - respond with CORS headers permitting the deployed origin.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { topEntries } from './leaderboard.mjs';

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
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
 * Read every leaderboard item for the single "LEADERBOARD" partition,
 * following pagination so the top-N is computed over the full set.
 */
async function queryAllEntries() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await doc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': PARTITION_KEY },
        ExclusiveStartKey,
      }),
    );
    if (out.Items?.length) items.push(...out.Items);
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * Lambda entry point. Never throws: on any failure it returns a 500 with CORS
 * headers so the browser fetch path stays well-behaved (Requirement 5.7).
 */
export async function handler() {
  try {
    const items = await queryAllEntries();
    return response(200, { entries: topEntries(items) });
  } catch (err) {
    console.error('getLeaderboard failed:', err);
    return response(500, { error: 'Failed to load leaderboard' });
  }
}
