//go:build windows || darwin || linux

package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/ollama/ollama/envconfig"
)

type WebFetch struct{}

type FetchRequest struct {
	URL string `json:"url"`
}

type FetchResponse struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Links   []string `json:"links"`
}

func (w *WebFetch) Name() string {
	return "web_fetch"
}

func (w *WebFetch) Description() string {
	return "Crawl and extract text content from web pages"
}

func (g *WebFetch) Schema() map[string]any {
	schemaBytes := []byte(`{
		"type": "object",
		"properties": {
			"url": {
				"type": "string",
				"description": "URL to crawl and extract content from"
            }
		},
		"required": ["url"]
	}`)
	var schema map[string]any
	if err := json.Unmarshal(schemaBytes, &schema); err != nil {
		return nil
	}
	return schema
}

func (w *WebFetch) Prompt() string {
	return ""
}

func (w *WebFetch) Execute(ctx context.Context, args map[string]any) (any, string, error) {
	urlRaw, ok := args["url"]
	if !ok {
		return nil, "", fmt.Errorf("url parameter is required")
	}
	urlStr, ok := urlRaw.(string)
	if !ok || strings.TrimSpace(urlStr) == "" {
		return nil, "", fmt.Errorf("url must be a non-empty string")
	}
	if !allowedDirectURL(ctx, urlStr) {
		return nil, "", fmt.Errorf("web fetch is only allowed for URLs provided by the user")
	}

	result, err := performWebFetch(ctx, urlStr)
	if err != nil {
		return nil, "", err
	}
	for _, link := range result.Links {
		addAllowedDirectURL(ctx, link)
	}

	return result, "", nil
}

func performWebFetch(ctx context.Context, targetURL string) (*FetchResponse, error) {
	if err := ensureCloudEnabledForTool(ctx, "web fetch is unavailable"); err != nil {
		return nil, err
	}

	reqBody := FetchRequest{URL: targetURL}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	// Route through the local Ollama server's proxy endpoint so that the
	// server's registered signing key is used for ollama.com authentication.
	// Going directly to ollama.com would use the app user's key, which may
	// not be the key registered with the account.
	targetReqURL := envconfig.Host().JoinPath("/api/experimental/web_fetch")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetReqURL.String(), bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute fetch request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch API error (status %d)", resp.StatusCode)
	}

	var result FetchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
