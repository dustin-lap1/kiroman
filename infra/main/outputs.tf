output "site_bucket_name" {
  value       = aws_s3_bucket.site.id
  description = "Frontend S3 bucket name"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.site.id
  description = "CloudFront distribution ID"
}

output "cloudfront_url" {
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
  description = "CloudFront URL for the site"
}

output "leaderboard_table_name" {
  value       = aws_dynamodb_table.leaderboard.name
  description = "DynamoDB leaderboard table name"
}

output "api_base_url" {
  value       = aws_apigatewayv2_api.api.api_endpoint
  description = "Base invoke URL for the Kiroman leaderboard HTTP API (frontend VITE_API_BASE / config.API_BASE)"
}
