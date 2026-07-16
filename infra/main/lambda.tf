########################################################################
# Kiroman leaderboard backend: Lambdas + IAM (Task 7.4)
#
# Two Node.js 22 Lambda functions back the leaderboard HTTP API:
#   - kiroman-get-leaderboard  -> GET  /leaderboard  (functions/getLeaderboard)
#   - kiroman-submit-score     -> POST /scores       (functions/submitScore)
#
# OUT-OF-BAND CODE DEPLOYMENT (important):
# The real function code is deployed separately via `update-function-code`
# (deploy scripts), NOT by Terraform. Terraform only carries the placeholder
# package below so the functions can be created/updated for INFRA changes.
# Each aws_lambda_function therefore sets:
#     lifecycle { ignore_changes = [source_code_hash, filename] }
# Without this, an apply that changes any infra attribute (memory, env vars,
# architecture, timeout, ...) would re-publish this placeholder over the live
# code and blank the function. Keep the guard on every Lambda resource.
########################################################################

# Placeholder deployment package. Zips infra/main/placeholder/ (a tiny stub
# handler) so `terraform` always has something valid to deploy. The real code
# replaces this out of band; ignore_changes keeps Terraform from clobbering it.
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  source_dir  = "${path.module}/placeholder"
  output_path = "${path.module}/placeholder.zip"
}

locals {
  lambda_runtime = "nodejs22.x"
  lambda_handler = "index.handler"

  # CORS origin allowed by the leaderboard API and echoed by the Lambdas.
  # Ties to the CloudFront distribution that serves the SPA (Requirement 8.5).
  # No dependency cycle: the API does not feed CloudFront.
  cors_origin = "https://${aws_cloudfront_distribution.site.domain_name}"

  lambda_env = {
    LEADERBOARD_TABLE = aws_dynamodb_table.leaderboard.name
    CORS_ORIGIN       = local.cors_origin
  }
}

# ---------------------------------------------------------------------------
# IAM: one execution role per function, each scoped to exactly what it needs
# on the leaderboard table (least privilege), plus basic logging.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# --- get-leaderboard role: dynamodb:Query on the table ---------------------
resource "aws_iam_role" "get_leaderboard" {
  name               = "kiroman-get-leaderboard-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Name = "kiroman-get-leaderboard-role"
  }
}

resource "aws_iam_role_policy_attachment" "get_leaderboard_basic" {
  role       = aws_iam_role.get_leaderboard.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "get_leaderboard_dynamodb" {
  statement {
    sid       = "QueryLeaderboard"
    effect    = "Allow"
    actions   = ["dynamodb:Query"]
    resources = [aws_dynamodb_table.leaderboard.arn]
  }
}

resource "aws_iam_role_policy" "get_leaderboard_dynamodb" {
  name   = "kiroman-get-leaderboard-dynamodb"
  role   = aws_iam_role.get_leaderboard.id
  policy = data.aws_iam_policy_document.get_leaderboard_dynamodb.json
}

# --- submit-score role: dynamodb:UpdateItem/GetItem on the table -----------
resource "aws_iam_role" "submit_score" {
  name               = "kiroman-submit-score-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Name = "kiroman-submit-score-role"
  }
}

resource "aws_iam_role_policy_attachment" "submit_score_basic" {
  role       = aws_iam_role.submit_score.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "submit_score_dynamodb" {
  statement {
    sid    = "UpsertBestScore"
    effect = "Allow"
    actions = [
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
    ]
    resources = [aws_dynamodb_table.leaderboard.arn]
  }
}

resource "aws_iam_role_policy" "submit_score_dynamodb" {
  name   = "kiroman-submit-score-dynamodb"
  role   = aws_iam_role.submit_score.id
  policy = data.aws_iam_policy_document.submit_score_dynamodb.json
}

# ---------------------------------------------------------------------------
# Lambda functions (Node.js 22). Code is a placeholder; real code is deployed
# out of band. ignore_changes protects the live code on infra applies.
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "get_leaderboard" {
  function_name = "kiroman-get-leaderboard"
  role          = aws_iam_role.get_leaderboard.arn
  runtime       = local.lambda_runtime
  handler       = local.lambda_handler
  timeout       = 10
  memory_size   = 128

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = local.lambda_env
  }

  # Real code is deployed out of band via update-function-code. Do NOT let
  # Terraform re-publish the placeholder on infra-only applies.
  lifecycle {
    ignore_changes = [source_code_hash, filename]
  }

  tags = {
    Name = "kiroman-get-leaderboard"
  }
}

resource "aws_lambda_function" "submit_score" {
  function_name = "kiroman-submit-score"
  role          = aws_iam_role.submit_score.arn
  runtime       = local.lambda_runtime
  handler       = local.lambda_handler
  timeout       = 10
  memory_size   = 128

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = local.lambda_env
  }

  # Real code is deployed out of band via update-function-code. Do NOT let
  # Terraform re-publish the placeholder on infra-only applies.
  lifecycle {
    ignore_changes = [source_code_hash, filename]
  }

  tags = {
    Name = "kiroman-submit-score"
  }
}
