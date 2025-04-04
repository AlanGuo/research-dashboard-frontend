"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check for system preference on initial load
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const savedTheme = localStorage.getItem("theme")
    const initialDarkMode = savedTheme === "dark" || (savedTheme !== "light" && prefersDark)
    
    setIsDarkMode(initialDarkMode)
    if (initialDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    if (!isDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
      aria-label="切换主题"
    >
      {isDarkMode ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  )
}
