########################################################################
# Kiroman leaderboard HTTP API (API Gateway v2) (Task 7.4)
#
# Routes:
#   GET  /leaderboard -> kiroman-get-leaderboard (AWS_PROXY, payload v2.0)
#   POST /scores      -> kiroman-submit-score    (AWS_PROXY, payload v2.0)
#
# CORS is configured on the API for the CloudFront origin (GET, POST, OPTIONS;
# content-type header), satisfying Requirement 8.5. The Lambdas also echo CORS
# headers themselves, so both the API-level CORS and the proxy responses agree.
########################################################################

resource "aws_apigatewayv2_api" "api" {
  name          = "kiroman-api"
  protocol_type = "HTTP"
  description   = "Kiroman leaderboard API"

  cors_configuration {
    allow_origins = [local.cors_origin]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 300
  }

  tags = {
    Name = "kiroman-api"
  }
}

# Default stage with auto-deploy so route changes go live without a manual
# deployment resource.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  tags = {
    Name = "kiroman-api-default"
  }
}

# --- get-leaderboard integration + route -----------------------------------
resource "aws_apigatewayv2_integration" "get_leaderboard" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_leaderboard.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_leaderboard" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /leaderboard"
  target    = "integrations/${aws_apigatewayv2_integration.get_leaderboard.id}"
}

resource "aws_lambda_permission" "get_leaderboard" {
  statement_id  = "AllowAPIGatewayInvokeGetLeaderboard"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_leaderboard.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/leaderboard"
}

# --- submit-score integration + route --------------------------------------
resource "aws_apigatewayv2_integration" "submit_score" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.submit_score.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "submit_score" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /scores"
  target    = "integrations/${aws_apigatewayv2_integration.submit_score.id}"
}

resource "aws_lambda_permission" "submit_score" {
  statement_id  = "AllowAPIGatewayInvokeSubmitScore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_score.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/scores"
}
