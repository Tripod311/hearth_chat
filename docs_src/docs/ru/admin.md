# Руководство админа

### Вкладка Node

- Настройка имени и описания узла
- Редактирование главной страницы (в формате JSON)

Пример:

```json
[
  {
    "type": "text",
    "data": {
      "title": "HearthChat node",
      "text": "Example of HearthChat node"
    }
  },
  {
    "type": "image",
    "data": {
      "src": "",
      "alt": "",
      "caption": "Some image"
    }
  },
  {
    "type": "refs",
    "data": [
      {
        "link": "",
        "title": "Welcome topic",
        "description": "Introduce yourself"
      },
      {
        "link": "",
        "title": "Max'x node",
        "description": "Meet my brother"
      }
    ]
  },
  {
    "type": "divider"
  },
  {
    "type": "custom",
    "data": {
      "content": "<span class=\"text-4xl\">Custom span</div>"
    }
  }
]
```

---

### Настройка голосового чата

Для работы голоса и видео:

- Укажите `announced_ip` (публичный IP сервера)
- Задайте ICE candidates

Пример:

```json
[
  {
    "urls": "stun:stun.l.google.com:19302"
  },
  {
    "urls": "turn:openrelay.metered.ca:80",
    "username": "openrelayproject",
    "credential": "openrelayproject"
  }
]
```

---

### Важные замечания

При изменении следующих параметров:

- `HTTP_PORT`
- `GATE_PORT`
- `announced_ip`
- `iceCandidates`

необходимо перезапустить сервер.

⚠️ Связи в федерации могут разорваться — потребуется повторное подключение узлов.

---

### Вкладка Users

- Создание, редактирование и удаление пользователей
- Генерация ссылок-приглашений (`Create Invite`)

---

### Вкладка Actors

- Просмотр пользователей, проходивших через узел
- Блокировка / разблокировка

Заблокированные пользователи:

- могут проходить через узел
- не могут читать топики и использовать чат

---

### Вкладка Topics

- Просмотр, редактирование и удаление топиков

---

### Вкладка Related

- Управление связями с другими узлами
- Отправка handshake-запросов

Для подключения:
1. Введите адрес узла (например `https://some-node.io:port`)
2. Добавьте сообщение (опционально)
3. Нажмите **Send**