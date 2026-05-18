output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint URL"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_database_name" {
  value = aws_db_instance.main.db_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for assets and datasets"
  value       = aws_s3_bucket.assets.bucket
}

output "ecr_registry" {
  description = "ECR registry URL"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
