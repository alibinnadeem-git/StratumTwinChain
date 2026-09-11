package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "init":
		err = initCommand(os.Args[2:])
	case "doctor":
		err = doctorCommand(os.Args[2:])
	case "verify-genesis":
		err = verifyCanonicalGenesisCommand(os.Args[2:])
	case "verify-package":
		err = verifyPackageCommand(os.Args[2:])
	case "version":
		fmt.Println(bootstrapVersion)
		return
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "STRATUM portable validator bootstrap")
	fmt.Fprintln(os.Stderr, "commands: init, doctor, verify-genesis, verify-package, version")
	fmt.Fprintln(os.Stderr, "This bootstrap creates CANDIDATE nodes only. It never grants vote authority.")
}
