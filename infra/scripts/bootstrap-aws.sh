#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tudumm AWS Bootstrap Script
# Run once to set up OIDC, IAM role, CDK bootstrap, and CDK deploy.
# Then it reads CDK outputs and sets all required GitHub secrets automatically.
#
# Prerequisites:
#   - aws configure  (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars)
#   - gh auth login  (GitHub CLI authenticated)
#   - node/npm/cdk available
#   - Run from repo root: bash infra/scripts/bootstrap-aws.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export PATH="$HOME/Library/Python/3.9/bin:/Users/sumit.bagewadi/.nvm/versions/node/v20.20.1/bin:$PATH"

REGION="ap-south-1"
GITHUB_REPO="SumitBagewadi-IB/Tudumm---Lead-Gen"
ROLE_NAME="tudumm-github-deploy"
STACK_NAME="TudummStack"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Tudumm AWS Bootstrap — ap-south-1 (Mumbai)      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Verify AWS identity ─────────────────────────────────────────────────
echo "▶ Checking AWS identity..."
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "  Account: $ACCOUNT  Region: $REGION"

# ── 2. Create OIDC provider (idempotent) ──────────────────────────────────
echo ""
echo "▶ Setting up GitHub Actions OIDC provider..."
OIDC_URL="https://token.actions.githubusercontent.com"
THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"

EXISTING=$(aws iam list-open-id-connect-providers \
  --query "OIDCProviderList[?ends_with(Arn,'token.actions.githubusercontent.com')].Arn" \
  --output text)

if [ -n "$EXISTING" ]; then
  OIDC_ARN="$EXISTING"
  echo "  Already exists: $OIDC_ARN"
else
  OIDC_ARN=$(aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "$THUMBPRINT" \
    --query OpenIDConnectProviderArn --output text)
  echo "  Created: $OIDC_ARN"
fi

# ── 3. Create IAM deploy role (idempotent) ────────────────────────────────
echo ""
echo "▶ Creating IAM deploy role: $ROLE_NAME..."

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "$OIDC_ARN" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF
)

ROLE_EXISTS=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text 2>/dev/null || echo "")

if [ -n "$ROLE_EXISTS" ]; then
  ROLE_ARN="$ROLE_EXISTS"
  echo "  Already exists: $ROLE_ARN"
  # Update trust policy in case it changed
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
  echo "  Trust policy updated."
else
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions OIDC deploy role for Tudumm" \
    --query Role.Arn --output text)
  echo "  Created: $ROLE_ARN"
fi

# ── 4. Attach policies to the deploy role ────────────────────────────────
echo ""
echo "▶ Attaching IAM policies..."
POLICIES=(
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
  "arn:aws:iam::aws:policy/AWSAppRunnerFullAccess"
  "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
  "arn:aws:iam::aws:policy/CloudFormationFullAccess"
)

for P in "${POLICIES[@]}"; do
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$P" 2>/dev/null || true
  echo "  Attached: $(basename $P)"
done

# Inline policy for ECR create, S3, Secrets, STS
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "tudumm-deploy-extras" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecr:CreateRepository","ecr:DescribeRepositories",
          "s3:*",
          "secretsmanager:GetSecretValue",
          "sts:GetCallerIdentity",
          "iam:PassRole",
          "ecs:RegisterTaskDefinition","ecs:DescribeServices","ecs:UpdateService",
          "apprunner:DescribeService","apprunner:StartDeployment",
          "prisma:*"
        ],
        "Resource": "*"
      }
    ]
  }'
echo "  Attached: tudumm-deploy-extras (inline)"

# ── 5. CDK Bootstrap ──────────────────────────────────────────────────────
echo ""
echo "▶ Bootstrapping CDK environment..."
cd "$(dirname "$0")/../.."
export CDK_DEFAULT_ACCOUNT="$ACCOUNT"
export CDK_DEFAULT_REGION="$REGION"

cdk bootstrap "aws://$ACCOUNT/$REGION" \
  --cloudformation-execution-policies "arn:aws:iam::aws:policy/AdministratorAccess" \
  --trust "$ACCOUNT" 2>&1 | tail -10

# ── 6. Install infra deps ─────────────────────────────────────────────────
echo ""
echo "▶ Installing CDK dependencies..."
cd infra
npm install 2>&1 | tail -3
cd ..

# ── 7. CDK Deploy ─────────────────────────────────────────────────────────
echo ""
echo "▶ Deploying TudummStack to AWS (this takes ~15 minutes first time)..."
echo "   ☕  Grab a coffee — Aurora + VPC setup is slow."
echo ""

cd infra
cdk deploy "$STACK_NAME" \
  --require-approval never \
  --outputs-file /tmp/cdk-outputs.json \
  2>&1
cd ..

# ── 8. Parse CDK outputs ──────────────────────────────────────────────────
echo ""
echo "▶ Parsing stack outputs..."
APPRUNNER_URL=$(cat /tmp/cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$STACK_NAME']['AppRunnerUrl'])")
DB_ENDPOINT=$(cat /tmp/cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$STACK_NAME']['DbEndpoint'])")
WEB_REPO=$(cat /tmp/cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$STACK_NAME']['WebEcrRepo'])")
WORKER_REPO=$(cat /tmp/cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$STACK_NAME']['WorkerEcrRepo'])")
CF_URL=$(cat /tmp/cdk-outputs.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$STACK_NAME']['CloudFrontUrl'])")

# Get App Runner service ARN from service URL
APPRUNNER_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceUrl=='$APPRUNNER_URL'].ServiceArn" \
  --output text --region "$REGION")

# Build DATABASE_URL from Aurora endpoint
DB_PASS=$(aws secretsmanager get-secret-value \
  --secret-id "tudumm/db-credentials" \
  --query SecretString --output text --region "$REGION" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['password'])")
DATABASE_URL="postgresql://tudumm:${DB_PASS}@${DB_ENDPOINT}:5432/tudumm?schema=public&sslmode=require"

echo "  App Runner URL:  $APPRUNNER_URL"
echo "  App Runner ARN:  $APPRUNNER_ARN"
echo "  CloudFront URL:  $CF_URL"
echo "  Web ECR repo:    $WEB_REPO"
echo "  Worker ECR repo: $WORKER_REPO"

# ── 9. Set GitHub Secrets ─────────────────────────────────────────────────
echo ""
echo "▶ Setting GitHub Actions secrets..."

if command -v gh &>/dev/null && gh auth status &>/dev/null; then
  gh secret set AWS_DEPLOY_ROLE_ARN   --body "$ROLE_ARN"       --repo "$GITHUB_REPO"
  gh secret set APPRUNNER_SERVICE_ARN --body "$APPRUNNER_ARN"  --repo "$GITHUB_REPO"
  gh secret set DATABASE_URL          --body "$DATABASE_URL"   --repo "$GITHUB_REPO"
  echo "  ✅ All 3 GitHub secrets set via gh CLI"
else
  echo "  ⚠️  gh CLI not authenticated. Set these manually in GitHub → Settings → Secrets:"
  echo ""
  echo "  AWS_DEPLOY_ROLE_ARN   = $ROLE_ARN"
  echo "  APPRUNNER_SERVICE_ARN = $APPRUNNER_ARN"
  echo "  DATABASE_URL          = (check AWS Secrets Manager: tudumm/db-credentials)"
  echo ""
fi

# ── 10. Summary ───────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅  Bootstrap Complete!                                     ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  App Runner: https://$APPRUNNER_URL"
echo "║  CloudFront: https://$CF_URL"
echo "║  Next: push to main → CI/CD deploys automatically           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  Remember to update NEXTAUTH_SECRET in AWS Secrets Manager:"
echo "   aws secretsmanager update-secret --secret-id tudumm/app-secrets \\"
echo "     --secret-string '{\"NEXTAUTH_SECRET\":\"<your-32-char-secret>\",\"ANTHROPIC_API_KEY\":\"<key>\"}'"
echo ""
