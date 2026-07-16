variable "project_name" {
  description = "Project name"
  type        = string
  default     = "kiroman"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}
