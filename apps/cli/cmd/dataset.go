package cmd

import (
	"fmt"
	"os"

	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

var datasetCmd = &cobra.Command{
	Use:   "dataset",
	Short: "Manage datasets",
}

var datasetListCmd = &cobra.Command{
	Use:   "list",
	Short: "List datasets in your workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var result struct {
			Data []struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				ItemCount int    `json:"itemCount"`
				SizeBytes int64  `json:"sizeBytes"`
				CreatedAt string `json:"createdAt"`
			} `json:"data"`
		}
		resp, err := client.R().SetResult(&result).Get("/storage/datasets")
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("failed to list datasets: %s", resp.String())
		}
		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"ID", "Name", "Items", "Size", "Created"})
		table.SetBorder(false)
		for _, d := range result.Data {
			table.Append([]string{
				d.ID[:8] + "...",
				d.Name,
				fmt.Sprintf("%d", d.ItemCount),
				formatBytes(d.SizeBytes),
				d.CreatedAt,
			})
		}
		table.Render()
		return nil
	},
}

var (
	exportFormat string
	exportOutput string
)

var datasetExportCmd = &cobra.Command{
	Use:   "export <dataset-id>",
	Short: "Export dataset to file",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		resp, err := client.R().
			SetQueryParam("format", exportFormat).
			Get(fmt.Sprintf("/storage/datasets/%s/export", args[0]))
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("export failed: %s", resp.String())
		}

		outPath := exportOutput
		if outPath == "" {
			outPath = fmt.Sprintf("dataset_%s.%s", args[0][:8], exportFormat)
		}
		if err := os.WriteFile(outPath, resp.Body(), 0644); err != nil {
			return fmt.Errorf("failed to write file: %w", err)
		}
		fmt.Printf("✓ Exported %d bytes to %s\n", len(resp.Body()), outPath)
		return nil
	},
}

func init() {
	datasetExportCmd.Flags().StringVarP(&exportFormat, "format", "f", "json", "Export format: json, csv, ndjson")
	datasetExportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "Output file path")
	datasetCmd.AddCommand(datasetListCmd, datasetExportCmd)
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
