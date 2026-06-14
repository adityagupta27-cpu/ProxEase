class ExplanationEngine:
    @staticmethod
    def explain(reasons: list) -> str:
        """
        Format a list of reasons into a clear human-readable sentence.
        """
        if not reasons:
            return "Eligible candidate."
        return ", ".join(reasons)
