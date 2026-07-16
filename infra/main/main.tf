terraform {
  required_version = ">= 1.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    bucket         = "kiroman-terraform-state"
    key            = "main/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "kiroman-terraform-locks"
    encrypt        = true
    profile        = "kiroman-terraform"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "kiroman-terraform"

  default_tags {
    tags = {
      Project = var.project_name
      Managed = "terraform"
    }
  }
}
