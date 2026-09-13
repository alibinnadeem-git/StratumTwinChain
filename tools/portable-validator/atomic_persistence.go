package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// syncParentDirectoryAfterRename makes a completed rename durable on POSIX-style
// filesystems by syncing the containing directory entry. Windows replacement
// handling is performed by the individual atomic writers and directory fsync is
// intentionally a no-op there.
func syncParentDirectoryAfterRename(path string) error {
	if path == "" || runtime.GOOS == "windows" {
		return nil
	}
	dir, err := os.Open(filepath.Dir(path))
	if err != nil {
		return fmt.Errorf("open parent directory for durability sync: %w", err)
	}
	defer dir.Close()
	if err := dir.Sync(); err != nil {
		return fmt.Errorf("sync parent directory after atomic rename: %w", err)
	}
	return nil
}
