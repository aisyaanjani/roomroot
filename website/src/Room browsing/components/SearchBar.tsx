import { useState } from "react";

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(searchTerm.trim());
  };

  const handleClear = () => {
    setSearchTerm("");
    onSearch("");
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search by city, state, ZIP code, or address..."
        aria-label="Search housing listings"
      />

      <button type="submit">Search</button>

      {searchTerm && (
        <button type="button" onClick={handleClear}>
          Clear
        </button>
      )}
    </form>
  );
}

export default SearchBar;