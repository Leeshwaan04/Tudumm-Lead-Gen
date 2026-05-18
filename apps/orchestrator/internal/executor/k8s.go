package executor

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const workerNamespace = "tudumm-workers"

type K8sProvisioner struct {
	client *kubernetes.Clientset
	log    *zap.Logger
}

func NewK8sProvisioner(client *kubernetes.Clientset, log *zap.Logger) *K8sProvisioner {
	return &K8sProvisioner{client: client, log: log}
}

func (k *K8sProvisioner) LaunchWorker(ctx context.Context, jobID uuid.UUID, image, encryptedPayload string) (string, error) {
	jobName := fmt.Sprintf("tudumm-job-%s", jobID.String()[:8])
	ttl := int32(600) // clean up 10min after completion
	backoff := int32(0)

	k8sJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: workerNamespace,
			Labels: map[string]string{
				"app":    "tudumm-worker",
				"job_id": jobID.String(),
			},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            &backoff,
			TTLSecondsAfterFinished: &ttl,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":    "tudumm-worker",
						"job_id": jobID.String(),
					},
				},
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:  "worker",
							Image: image,
							Env: []corev1.EnvVar{
								{Name: "TUDUMM_JOB_ID", Value: jobID.String()},
								{Name: "TUDUMM_PAYLOAD", Value: encryptedPayload},
								{Name: "ORCHESTRATOR_GRPC_ADDR", ValueFrom: &corev1.EnvVarSource{
									ConfigMapKeyRef: &corev1.ConfigMapKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: "tudumm-config"},
										Key:                  "ORCHESTRATOR_GRPC_ADDR",
									},
								}},
								{Name: "PAYLOAD_ENCRYPTION_KEY", ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: "tudumm-secrets"},
										Key:                  "PAYLOAD_ENCRYPTION_KEY",
									},
								}},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("500m"),
									corev1.ResourceMemory: resource.MustParse("512Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("2"),
									corev1.ResourceMemory: resource.MustParse("2Gi"),
								},
							},
						},
					},
				},
			},
		},
	}

	created, err := k.client.BatchV1().Jobs(workerNamespace).Create(ctx, k8sJob, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("create k8s job: %w", err)
	}

	k.log.Info("launched worker pod", zap.String("job_id", jobID.String()), zap.String("k8s_job", created.Name))
	return created.Name, nil
}

func (k *K8sProvisioner) DeleteJob(ctx context.Context, jobName string) error {
	propagation := metav1.DeletePropagationForeground
	return k.client.BatchV1().Jobs(workerNamespace).Delete(ctx, jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
}
