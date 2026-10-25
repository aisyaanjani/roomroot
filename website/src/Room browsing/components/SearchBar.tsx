import { useId, useState } from "react";
import { filterBrowseLocations } from "../../features/housing-profile/locationData";

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `browse-location-${useId().replace(/:/g, "")}`;
  const suggestions = filterBrowseLocations(searchTerm);

  const selectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    setOpen(false);
    setActive(-1);
    onSearch(suggestion);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(searchTerm.trim());
  };

  const handleClear = () => {
    setSearchTerm("");
    setOpen(false);
    onSearch("");
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="browse-search-combobox">
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={searchTerm}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setSearchTerm(event.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) => nextBrowseSuggestionIndex(current, event.key === "ArrowDown" ? 1 : -1, suggestions.length));
            } else if (event.key === "Enter" && open && active >= 0 && suggestions[active]) {
              event.preventDefault();
              selectSuggestion(suggestions[active]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          placeholder="Search by city, state, ZIP code, or address..."
          aria-label="Search housing listings"
        />
        {open && suggestions.length > 0 && <ul id={listId} role="listbox" className="browse-search-suggestions">
          {suggestions.map((suggestion, index) => <li id={`${listId}-${index}`} role="option" aria-selected={active === index} key={suggestion} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => selectSuggestion(suggestion)}>{suggestion}</li>)}
        </ul>}
        <span className="browse-search-status" role="status">{open && searchTerm ? `${suggestions.length} local ${suggestions.length === 1 ? "suggestion" : "suggestions"}. Suggestions do not guarantee available listings.${active >= 0 && suggestions[active] ? ` ${suggestions[active]} highlighted.` : ""}` : ""}</span>
      </div>

      <button type="submit">Search</button>

      {searchTerm && (
        <button type="button" onClick={handleClear}>
          Clear
        </button>
      )}
    </form>
  );
}

function nextBrowseSuggestionIndex(current: number, direction: 1 | -1, count: number) {
  if (count === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}

export default SearchBar;
