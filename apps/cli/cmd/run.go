package cmd

import (
	"fmt"
	"os"

	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Manage actor runs",
}

var runListCmd = &cobra.Command{
	Use:   "list",
	Short: "List recent runs",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var result struct {
			Data []struct {
				ID        string `json:"id"`
				ActorID   string `json:"actorId"`
				Status    string `json:"status"`
				StartedAt string `json:"startedAt"`
				Duration  int    `json:"durationMs"`
			} `json:"data"`
		}
		resp, err := client.R().SetResult(&result).Get("/runs?limit=20")
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("failed to list runs: %s", resp.String())
		}
		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"ID", "Actor", "Status", "Started", "Duration"})
		table.SetBorder(false)
		for _, r := range result.Data {
			table.Append([]string{
				r.ID[:8] + "...",
				r.ActorID[:8] + "...",
				r.Status,
				r.StartedAt,
				fmt.Sprintf("%dms", r.Duration),
			})
		}
		table.Render()
		return nil
	},
}

var runGetCmd = &cobra.Command{
	Use:   "get <run-id>",
	Short: "Get run details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var result map[string]any
		resp, err := client.R().SetResult(&result).Get(fmt.Sprintf("/runs/%s", args[0]))
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("run not found")
		}
		for k, v := range result {
			fmt.Printf("%-20s %v\n", k+":", v)
		}
		return nil
	},
}

var runCancelCmd = &cobra.Command{
	Use:   "cancel <run-id>",
	Short: "Cancel a running job",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		resp, err := client.R().Delete(fmt.Sprintf("/runs/%s", args[0]))
		if err != nil || resp.StatusCode() > 299 {
			return fmt.Errorf("failed to cancel run: %s", resp.String())
		}
		fmt.Printf("Run %s cancelled.\n", args[0])
		return nil
	},
}

func init() {
	runCmd.AddCommand(runListCmd, runGetCmd, runCancelCmd)
}
