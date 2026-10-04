# Starts the GroupMart backend locally on port 8080.
# Usage (from PowerShell, inside the backend folder):  .\start-backend.ps1

Set-Location $PSScriptRoot

$env:SPRING_DATASOURCE_PASSWORD = "1234"
$env:PORT = "8080"

# -proc:full is needed on JDK 23+ so Lombok's annotation processor runs.
& "$env:USERPROFILE\tools\apache-maven-3.9.9\bin\mvn.cmd" "-Dmaven.compiler.proc=full" spring-boot:run
