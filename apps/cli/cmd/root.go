package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "tudumm",
	Short: "Tudumm CLI — manage actors, runs, datasets, and proxies",
	Long: `Tudumm CLI gives you full programmatic access to the Tudumm platform.

Build and deploy Actors, manage runs, export datasets, and configure
your workspace from the command line.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default: ~/.tudumm/config.yaml)")
	rootCmd.PersistentFlags().String("api-key", "", "Tudumm API key (overrides config)")
	rootCmd.PersistentFlags().String("base-url", "https://api.tudumm.io", "API base URL")
	viper.BindPFlag("api_key", rootCmd.PersistentFlags().Lookup("api-key"))
	viper.BindPFlag("base_url", rootCmd.PersistentFlags().Lookup("base-url"))

	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(actorCmd)
	rootCmd.AddCommand(datasetCmd)
	rootCmd.AddCommand(runCmd)
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		home, _ := os.UserHomeDir()
		viper.AddConfigPath(filepath.Join(home, ".tudumm"))
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
	}
	viper.SetEnvPrefix("TUDUMM")
	viper.AutomaticEnv()
	viper.ReadInConfig()
}

func apiKey() string {
	key := viper.GetString("api_key")
	if key == "" {
		fmt.Fprintln(os.Stderr, "Error: no API key configured. Run 'tudumm login' first.")
		os.Exit(1)
	}
	return key
}

func baseURL() string {
	return viper.GetString("base_url")
}
