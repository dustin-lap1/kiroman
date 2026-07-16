// Placeholder Lambda handler for Terraform.
//
// The REAL Kiroman Lambda code (functions/getLeaderboard, functions/submitScore)
// is deployed OUT OF BAND via `update-function-code` (see deploy scripts / the
// LaunchPad deployment guidance), NOT by Terraform. Terraform only needs *some*
// deployable artifact to create each aws_lambda_function, so it packages this
// tiny stub via the `archive_file` data source.
//
// Every aws_lambda_function in lambda.tf carries:
//   lifecycle { ignore_changes = [source_code_hash, filename] }
// so a later `terraform apply` that changes an infra attribute (memory, env,
// arch, etc.) will NOT re-publish this placeholder over the live function code.
export async function handler() {
  return {
    statusCode: 501,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Placeholder handler — real code is deployed out of band.',
    }),
  };
}
