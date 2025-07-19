"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface AutocompleteOption {
  codigo: string
  nombre: string
  precio_base?: number
  tiene_iva?: boolean
}

interface AutocompleteProps {
  label: string
  placeholder: string
  apiEndpoint: string
  value: string
  onSelect: (option: AutocompleteOption) => void
  required?: boolean
}

export function Autocomplete({ label, placeholder, apiEndpoint, value, onSelect, required }: AutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<AutocompleteOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      if (query.length < 2) {
        setOptions([])
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`${apiEndpoint}?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setOptions(data)
      } catch (error) {
        console.error("Error fetching options:", error)
        setOptions([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(fetchOptions, 300)
    return () => clearTimeout(debounceTimer)
  }, [query, apiEndpoint])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowOptions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    setShowOptions(true)
  }

  const handleOptionSelect = (option: AutocompleteOption) => {
    setQuery(`${option.codigo} - ${option.nombre}`)
    setShowOptions(false)
    onSelect(option)
  }

  return (
    <div className="relative space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowOptions(true)}
          placeholder={placeholder}
          required={required}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showOptions && options.length > 0 && (
        <Card ref={optionsRef} className="absolute z-50 w-full max-h-60 overflow-y-auto border shadow-lg">
          <div className="p-1">
            {options.map((option, index) => (
              <div
                key={`${option.codigo}-${index}`}
                className="px-3 py-2 cursor-pointer hover:bg-muted rounded-sm transition-colors"
                onClick={() => handleOptionSelect(option)}
              >
                <div className="font-medium text-sm">{option.codigo}</div>
                <div className="text-xs text-muted-foreground">{option.nombre}</div>
                {option.precio_base && (
                  <div className="text-xs text-green-600">${option.precio_base.toLocaleString("es-CO")} COP</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showOptions && query.length >= 2 && options.length === 0 && !isLoading && (
        <Card ref={optionsRef} className="absolute z-50 w-full border shadow-lg">
          <div className="p-3 text-sm text-muted-foreground text-center">
            No se encontraron resultados para "{query}"
          </div>
        </Card>
      )}
    </div>
  )
}
