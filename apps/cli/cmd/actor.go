package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/go-resty/resty/v2"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

var actorCmd = &cobra.Command{
	Use:   "actor",
	Short: "Manage actors",
}

var actorListCmd = &cobra.Command{
	Use:   "list",
	Short: "List actors in your workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var result struct {
			Data []struct {
				ID          string  `json:"id"`
				Name        string  `json:"name"`
				Status      string  `json:"status"`
				TotalRuns   int     `json:"totalRuns"`
				Rating      float64 `json:"rating"`
			} `json:"data"`
		}
		resp, err := client.R().SetResult(&result).Get("/actors?my=true")
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("failed to list actors: %s", resp.String())
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"ID", "Name", "Status", "Runs", "Rating"})
		table.SetBorder(false)
		for _, a := range result.Data {
			table.Append([]string{
				a.ID[:8] + "...",
				a.Name,
				a.Status,
				fmt.Sprintf("%d", a.TotalRuns),
				fmt.Sprintf("%.1f", a.Rating),
			})
		}
		table.Render()
		return nil
	},
}

var actorRunInput string
var actorRunCmd = &cobra.Command{
	Use:   "run <actor-id>",
	Short: "Start an actor run",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var input map[string]any
		if actorRunInput != "" {
			if err := json.Unmarshal([]byte(actorRunInput), &input); err != nil {
				return fmt.Errorf("invalid JSON input: %w", err)
			}
		}

		var result struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		resp, err := client.R().
			SetBody(map[string]any{"input": input}).
			SetResult(&result).
			Post(fmt.Sprintf("/actors/%s/run", args[0]))
		if err != nil || resp.StatusCode() > 299 {
			return fmt.Errorf("failed to start run: %s", resp.String())
		}

		color.Green("✓ Run started: %s (status: %s)", result.ID, result.Status)
		fmt.Printf("  Track progress: tudumm run get %s\n", result.ID)
		return nil
	},
}

var actorPushCmd = &cobra.Command{
	Use:   "push",
	Short: "Build and publish actor from ./tudumm.json",
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile("tudumm.json")
		if err != nil {
			return fmt.Errorf("tudumm.json not found in current directory")
		}
		var manifest map[string]any
		if err := json.Unmarshal(data, &manifest); err != nil {
			return fmt.Errorf("invalid tudumm.json: %w", err)
		}

		client := newClient()
		var result struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		}
		resp, err := client.R().
			SetBody(manifest).
			SetResult(&result).
			Post("/actors")
		if err != nil || resp.StatusCode() > 299 {
			return fmt.Errorf("failed to publish actor: %s", resp.String())
		}

		color.Green("✓ Actor published: %s (version %s)", result.ID, result.Version)
		return nil
	},
}

var actorLogsCmd = &cobra.Command{
	Use:   "logs <run-id>",
	Short: "Stream logs for a run",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := newClient()
		var result struct {
			Data []struct {
				Timestamp string `json:"timestamp"`
				Level     string `json:"level"`
				Message   string `json:"message"`
			} `json:"data"`
		}
		resp, err := client.R().SetResult(&result).Get(fmt.Sprintf("/runs/%s/logs", args[0]))
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("failed to fetch logs: %s", resp.String())
		}
		for _, log := range result.Data {
			var levelColor func(format string, a ...interface{}) string
			switch log.Level {
			case "ERROR":
				levelColor = color.RedString
			case "WARN":
				levelColor = color.YellowString
			default:
				levelColor = color.WhiteString
			}
			fmt.Printf("%s [%s] %s\n", log.Timestamp, levelColor(log.Level), log.Message)
		}
		return nil
	},
}

func init() {
	actorRunCmd.Flags().StringVarP(&actorRunInput, "input", "i", "", "JSON input for the actor")
	actorCmd.AddCommand(actorListCmd, actorRunCmd, actorPushCmd, actorLogsCmd)
}

func newClient() *resty.Client {
	return resty.New().
		SetBaseURL(baseURL()).
		SetHeader("Authorization", "Bearer "+apiKey()).
		SetHeader("Content-Type", "application/json")
}
