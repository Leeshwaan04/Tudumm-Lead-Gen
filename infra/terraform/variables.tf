# ─────────────────────────────────────────────
# Tudumm — Terraform Input Variables
# ─────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy all resources into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "environment must be one of: production, staging, development"
  }
}

variable "project" {
  description = "Project name — used as a prefix for all resource names and tags"
  type        = string
  default     = "tudumm"
}

# ── VPC ───────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use for subnet placement"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# ── EKS ───────────────────────────────────────

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "tudumm-eks"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "on_demand_instance_types" {
  description = "EC2 instance types for the on-demand node group"
  type        = list(string)
  default     = ["m6i.xlarge", "m6a.xlarge"]
}

variable "spot_instance_types" {
  description = "EC2 instance types for the spot node group (executor nodes)"
  type        = list(string)
  default     = ["m6i.2xlarge", "m6a.2xlarge", "m5.2xlarge", "m5a.2xlarge"]
}

variable "on_demand_min_size" {
  description = "Minimum number of on-demand nodes"
  type        = number
  default     = 2
}

variable "on_demand_max_size" {
  description = "Maximum number of on-demand nodes"
  type        = number
  default     = 10
}

variable "on_demand_desired_size" {
  description = "Desired number of on-demand nodes"
  type        = number
  default     = 3
}

variable "spot_min_size" {
  description = "Minimum number of spot (executor) nodes"
  type        = number
  default     = 1
}

variable "spot_max_size" {
  description = "Maximum number of spot (executor) nodes"
  type        = number
  default     = 50
}

variable "spot_desired_size" {
  description = "Desired number of spot (executor) nodes"
  type        = number
  default     = 3
}

# ── RDS ───────────────────────────────────────

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "tudumm"
}

variable "db_username" {
  description = "Master username for the RDS instance"
  type        = string
  default     = "tudumm"
  sensitive   = true
}

variable "db_password" {
  description = "Master password for the RDS instance (use Secrets Manager in production)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r8g.large"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS (GiB)"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS autoscaling (GiB)"
  type        = number
  default     = 1000
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated RDS backups"
  type        = number
  default     = 14
}

variable "db_multi_az" {
  description = "Whether to enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

# ── ElastiCache Redis ─────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r7g.large"
}

variable "redis_num_shards" {
  description = "Number of Redis shards (cluster mode)"
  type        = number
  default     = 2
}

variable "redis_replicas_per_shard" {
  description = "Number of read replicas per shard"
  type        = number
  default     = 1
}

# ── S3 ────────────────────────────────────────

variable "datasets_bucket_name" {
  description = "S3 bucket name for actor datasets and KV entries"
  type        = string
  default     = "tudumm-datasets"
}

variable "actor_layers_bucket_name" {
  description = "S3 bucket name for actor Docker layer caches"
  type        = string
  default     = "tudumm-actor-layers"
}

variable "datasets_lifecycle_days" {
  description = "Days before transitioning datasets to Glacier Instant Retrieval"
  type        = number
  default     = 90
}

# ── ECR ───────────────────────────────────────

variable "ecr_image_retention_count" {
  description = "Number of tagged images to retain per ECR repository"
  type        = number
  default     = 30
}
