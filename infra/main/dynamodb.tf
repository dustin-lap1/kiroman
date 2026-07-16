resource "aws_dynamodb_table" "leaderboard" {
  name         = "kiroman-leaderboard"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "alias"

  # Only key attributes are declared. `level` and `achievedAt` are non-key
  # item attributes and must NOT be declared here.
  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "alias"
    type = "S"
  }

  tags = {
    Name    = "kiroman-leaderboard"
    Project = "kiroman"
    Managed = "terraform"
  }
}
