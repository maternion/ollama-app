//go:build windows || darwin || linux

package assets

import (
	"embed"
	"io/fs"
)

//go:embed *.ico *.png
var icons embed.FS

func ListIcons() ([]string, error) {
	return fs.Glob(icons, "*")
}

func GetIcon(filename string) ([]byte, error) {
	return icons.ReadFile(filename)
}
