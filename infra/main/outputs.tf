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
