package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	survey "github.com/AlecAivazis/survey/v2"
	"github.com/fatih/color"
	"github.com/go-resty/resty/v2"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with the Tudumm platform",
	RunE: func(cmd *cobra.Command, args []string) error {
		var apiKey string
		prompt := &survey.Password{
			Message: "Enter your Tudumm API key:",
			Help:    "Find your API key at https://app.tudumm.io/settings/api-keys",
		}
		if err := survey.AskOne(prompt, &apiKey); err != nil {
			return err
		}

		client := resty.New().SetBaseURL(baseURL())
		resp, err := client.R().
			SetHeader("Authorization", "Bearer "+apiKey).
			Get("/auth/me")
		if err != nil || resp.StatusCode() != 200 {
			return fmt.Errorf("invalid API key — could not authenticate")
		}

		home, _ := os.UserHomeDir()
		configDir := filepath.Join(home, ".tudumm")
		os.MkdirAll(configDir, 0700)

		config := map[string]string{
			"api_key":  apiKey,
			"base_url": baseURL(),
		}
		data, _ := yaml.Marshal(config)
		configPath := filepath.Join(configDir, "config.yaml")
		if err := os.WriteFile(configPath, data, 0600); err != nil {
			return fmt.Errorf("failed to save config: %w", err)
		}

		color.Green("✓ Authenticated! Config saved to %s", configPath)
		return nil
	},
}
