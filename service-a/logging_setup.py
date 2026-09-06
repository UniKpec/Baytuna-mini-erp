import json
import logging
import sys

# LogRecord'un kendi alanları; bunların dışında kalan her şey "extra" ile eklenmiş demektir.
STANDARD_FIELDS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Middleware'in eklediği alanlar (kim, hangi endpoint, ne sonuç) buraya düşer.
        for key, value in record.__dict__.items():
            if key not in STANDARD_FIELDS:
                log[key] = value
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log, ensure_ascii=False, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root_logger = logging.getLogger()
    # Uvicorn kendi handler'ını kuruyor, iki kez basmasın diye üzerine yazıyoruz.
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)

    # Uvicorn'un access log'u middleware'imizle aynı isteği ikinci kez basıyor, kapatıyoruz.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = [handler]
        uvicorn_logger.propagate = False
